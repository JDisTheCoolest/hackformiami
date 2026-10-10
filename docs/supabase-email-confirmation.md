# Supabase email confirmation

4forces uses a token-hash confirmation callback so a user can open a signup email in a different browser or device. In the Supabase dashboard, go to **Authentication → Email Templates → Confirm signup** and use this link in the template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Confirm your email
</a>
```

In **Authentication → URL Configuration**, set **Site URL** to the deployed 4forces origin. Add both of these to **Additional Redirect URLs** while developing:

```text
http://localhost:5173/auth/confirm
https://YOUR-PRODUCTION-DOMAIN/auth/confirm
```

Do not use `{{ .ConfirmationURL }}` for the signup template with this Vite app: when the client is configured for PKCE, it returns an authorization code that needs a verifier stored in the browser which initiated signup. The token-hash link is verified by the callback using `supabase.auth.verifyOtp`, which creates a session without that browser-local verifier.

Previously delivered PKCE `code` links are handled only when their verifier is present locally. Otherwise the user sees a sign-in path instead of a raw PKCE error.
