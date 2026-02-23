import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthService } from "../service";
import type { AuthUser } from "../types/auth.types";

export type UseAuthDeps = {
  authService: AuthService;

  getToken: () => string | null;
  setToken: (token: string | null) => void;

  getLanguage: () => string;

  // optional post-signup navigation
  navigate?: (path: string, opts?: { replace?: boolean }) => void;

  // optional verify path resolver
  getVerifyPath?: (lang: string) => string;
};

export type UseAuthResult = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loadingUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    acceptTerms: boolean,
    acceptPrivacyPolicy: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  confirmEmail: (hash: string) => Promise<void>;
};

export function createUseAuth(deps: UseAuthDeps) {
  return function useAuth(): UseAuthResult {
    const queryClient = useQueryClient();

    const token = deps.getToken();
    const lang = deps.getLanguage();

    const meQuery = useQuery<AuthUser | null>({
      queryKey: ["auth", "me", token],
      queryFn: () => deps.authService.me(lang),
      enabled: !!token,
      staleTime: 1000 * 60,
      retry: 1,
    });

    const loginMutation = useMutation({
      mutationFn: (payload: { email: string; password: string }) =>
        deps.authService.login(payload, lang),

      onSuccess: async (newToken) => {
        deps.setToken(newToken);

        // Important: ensure me() refetches under new token
        await queryClient.invalidateQueries({
          queryKey: ["auth", "me"],
        });
      },
    });

    const signupMutation = useMutation({
      mutationFn: (payload: {
        email: string;
        password: string;
        acceptTerms: boolean;
        acceptPrivacyPolicy: boolean;
      }) => deps.authService.register(payload, lang),

      onSuccess: async () => {
        if (deps.navigate && deps.getVerifyPath) {
          const verifyPath = deps.getVerifyPath(lang);
          deps.navigate(verifyPath, { replace: true });
        }
      },
    });

    const logoutMutation = useMutation({
      mutationFn: async () => {
        try {
          await deps.authService.logout(lang);
        } catch {
          // ignore network failure
        }
      },

      onSuccess: async () => {
        deps.setToken(null);

        // Remove cached user completely
        await queryClient.removeQueries({
          queryKey: ["auth", "me"],
        });
      },
    });

    const confirmEmailMutation = useMutation({
      mutationFn: (hash: string) => deps.authService.confirmEmail(hash, lang),
    });

    const login = useCallback(
      async (email: string, password: string) => {
        await loginMutation.mutateAsync({ email, password });
      },
      [loginMutation],
    );

    const signup = useCallback(
      async (
        email: string,
        password: string,
        acceptTerms: boolean,
        acceptPrivacyPolicy: boolean,
      ) => {
        await signupMutation.mutateAsync({
          email,
          password,
          acceptTerms,
          acceptPrivacyPolicy,
        });
      },
      [signupMutation],
    );

    const logout = useCallback(async () => {
      await logoutMutation.mutateAsync();
    }, [logoutMutation]);

    const confirmEmail = useCallback(
      (hash: string) => confirmEmailMutation.mutateAsync(hash),
      [confirmEmailMutation],
    );

    return {
      user: meQuery.data || null,
      token,
      isAuthenticated: !!token,
      loadingUser: meQuery.isLoading,
      login,
      signup,
      logout,
      confirmEmail,
    };
  };
}
