# DuooNex website integration

Parent website: https://johnzzzantony.github.io/agency

Nexora's sidebar and footer already point to this DuooNex website. The parent is hosted on GitHub Pages; Nexora requires a Node-capable deployment host.

After deploying Nexora, add the following link to the parent website's navigation/product area. Replace `YOUR_NEXORA_HOST` with the actual HTTPS app host; this is a template, not a deployed URL.

```html
<a href="https://YOUR_NEXORA_HOST/login" target="_blank" rel="noopener noreferrer">
  Nexora — Manage tickets and team work
</a>
```

Suggested product description: **Nexora. Connect. Assign. Achieve. A DuooNex workspace for support tickets, tasks and team operations.**

Use `/portal/tickets` if the entry should lead customers to the customer portal; unsigned users are redirected to sign-in and retain their destination. Keep `/login` for a general staff entry point. The parent website repository was not supplied in this workspace, and no modification has been published to that site.
