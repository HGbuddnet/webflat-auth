import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthService } from "../service";
import type { AuthUser } from "../types/auth.types";

export type UseAuthDeps = {
  authService: AuthService;

  getToken: () => string | null;
  setToken: (token: string | null) => void;

  getLanguage: () => string;

  // optional post-signup navigation (MUST be a plain function, not calling hooks)
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

const ME_QUERY_KEY = ["auth", "me"] as const;

export function createUseAuth(deps: UseAuthDeps) {
  return function useAuth(): UseAuthResult {
    const queryClient = useQueryClient();

    const token = deps.getToken();
    const lang = deps.getLanguage();

    // --- current user (me) ---
    const meQuery = useQuery<AuthUser | null>({
      queryKey: [...ME_QUERY_KEY, token] as const,
      queryFn: async () => deps.authService.me(lang),
      enabled: !!token,
      staleTime: 1000 * 60,
      retry: 1,
    });

    // --- login ---
    const loginMutation = useMutation({
      mutationFn: (payload: { email: string; password: string }) =>
        deps.authService.login(payload, lang),
      onSuccess: async (newToken) => {
        deps.setToken(newToken);

        // Refetch user under new token
        await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      },
    });

    // --- signup ---
    const signupMutation = useMutation({
      mutationFn: (payload: {
        email: string;
        password: string;
        acceptTerms: boolean;
        acceptPrivacyPolicy: boolean;
      }) => deps.authService.register(payload, lang),
      onSuccess: async () => {
        // Optional redirect to verify page
        if (deps.navigate && deps.getVerifyPath) {
          deps.navigate(deps.getVerifyPath(lang), { replace: true });
        }
      },
    });

    // --- logout ---
    const logoutMutation = useMutation({
      mutationFn: async () => {
        try {
          await deps.authService.logout(lang);
        } catch {
          // ignore network failures on logout
        }
      },
      onSuccess: async () => {
        deps.setToken(null);

        // Hard-clear cached user (avoid showing stale user)
        await queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      },
    });

    // --- confirm email ---
    const confirmEmailMutation = useMutation({
      mutationFn: (hash: string) => deps.authService.confirmEmail(hash, lang),
    });

    // --- stable API ---
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
      async (hash: string) => {
        await confirmEmailMutation.mutateAsync(hash);
      },
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
