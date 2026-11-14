/*
 * Public, non-secret site configuration.
 * Everything in this file is visible to every visitor, so NEVER put passwords,
 * API keys or SMTP credentials here. Mail credentials live only in the
 * Cloudflare Worker (see /worker and docs/DEPLOYMENT.md).
 *
 *  formEndpoint     URL of the deployed enquiry Worker, e.g.
 *                   "https://enquiry.<your-subdomain>.workers.dev/api/enquiry"
 *  turnstileSiteKey Cloudflare Turnstile *site* key (public by design).
 */
document.documentElement.classList.add('js');
window.DRAGON_CONFIG = {
  formEndpoint: '',
  turnstileSiteKey: ''
};
