import DOMPurify from 'isomorphic-dompurify';

/**
 * Letter bodies are HTML. Only this tag set survives sanitizing, both when rendering a thread
 * and when the compose editor output is sent.
 */
const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'span'];
const ALLOWED_ATTR = ['href', 'rel', 'target'];
const SAFE_PROTOCOLS = /^(https?:|mailto:)/i;

let hooked = false;

function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return;
    const href = node.getAttribute('href');
    if (href === null || !SAFE_PROTOCOLS.test(href.trim())) {
      node.removeAttribute('href');
    }
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('target', '_blank');
  });
}

/** Sanitize letter HTML to the allowlist: tags above, links only http, https or mailto. */
export function sanitizeLetterHtml(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
