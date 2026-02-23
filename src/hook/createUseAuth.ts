import { useCallback } from "react";
import { AuthService } from "../service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthUser } from "../types/auth.types";

export type UseAuthDeps = {
  authService: AuthService;

  // token storage
  getToken: () => string | null;
  setToken: (token: string | null) => void;

  // language provider
  getLanguage: () => string;

  // navigation (optional)
  navigate?: (path: string, opts?: { replace?: boolean }) => void;
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
      queryKey: ["auth", "me"],
      queryFn: () => deps.authService.me(lang),
      enabled: !!token,
      staleTime: 1000 * 60,
      retry: 1,
    });

    const loginMutation = useMutation({
      mutationFn: (payload: { email: string; password: string }) =>
        deps.authService.login(payload, lang),
      onSuccess: async (result) => {
        deps.setToken(result);
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
    });

    const signupMutation = useMutation({
      mutationFn: (payload: {
        email: string;
        password: string;
        acceptTerms: boolean;
        acceptPrivacyPolicy: boolean;
      }) => deps.authService.register(payload, lang),
    });

    const logoutMutation = useMutation({
      mutationFn: async () => {
        try {
          await deps.authService.logout(lang);
        } catch {}
      },
      onSuccess: async () => {
        deps.setToken(null);
        await queryClient.resetQueries({ queryKey: ["auth", "me"] });
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
