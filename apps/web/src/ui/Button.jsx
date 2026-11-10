/* Button. variant: secondary (default) | primary | ghost | danger.
 * size: md (default) | lg (44 px, for touch-first spots). Icon-only buttons
 * pass `icon` and must give an aria-label. */
export default function Button({ variant = 'secondary', size = 'md', icon = false, className = '', type = 'button', ...rest }) {
  const cls = [
    'ui-btn',
    variant !== 'secondary' && `ui-btn--${variant}`,
    size === 'lg' && 'ui-btn--lg',
    icon && 'ui-btn--icon',
    className,
  ].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
