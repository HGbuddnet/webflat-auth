import type { HttpClient } from "@hgbuddnet/webflat-service";
import { AuthUser, LoginRequest, RegisterRequest } from "../types/auth.types";

export class AuthService {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  login(data: LoginRequest, lang: string = "en"): Promise<string> {
    return this.http.post<string, LoginRequest>("/authentication/login", data, {
      parseAs: "text",
      lang,
    });
  }

  register(data: RegisterRequest, lang: string = "en"): Promise<void> {
    return this.http.post<void, RegisterRequest>(
      "/authentication/register",
      data,
      { lang },
    );
  }

  me(lang: string = "en"): Promise<AuthUser> {
    return this.http.get<AuthUser>("/user", { lang });
  }

  logout(lang: string = "en"): Promise<void> {
    return this.http.post<void, {}>("/logout", {}, { lang });
  }

  confirmEmail(hash: string, lang: string = "en"): Promise<void> {
    return this.http.post<void, { hash: string }>(
      "/authentication/confirm",
      { hash },
      { lang },
    );
  }
}
