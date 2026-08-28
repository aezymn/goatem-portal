import DOMPurify from 'isomorphic-dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

/**
 * Safely renders HTML/Markdown by sanitizing it first to prevent XSS.
 * Only allows basic formatting tags.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });

  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={{ __html: cleanHtml }} 
    />
  );
}
