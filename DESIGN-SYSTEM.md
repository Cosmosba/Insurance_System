# emPLE UI design system

The default visual language for this application is a restrained glassmorphism
built around apple green (`#8DB600`), white, light neutral backgrounds, and
charcoal text. Use frosted surfaces to establish hierarchy; do not make every
element translucent or trade readability for blur.

## Reuse before adding

- Inspect existing layouts and page styles before creating a new component.
- Reuse the current staff, customer, and Superadmin shells and their responsive
  navigation. Keep routes, permissions, and business logic unchanged for visual
  work.
- Shared tokens and glass surface conventions live in
  `src/styles/glass-system.css`. Add or extend tokens and common selectors there
  instead of copying large style blocks into pages.
- Existing page-level CSS defines layout and component-specific behavior.
  Prefer shared tokens in new styles and use the glass surface variables:
  `--glass-surface`, `--glass-surface-strong`, `--glass-border`,
  `--glass-shadow`, `--glass-blur`, and the `--glass-radius-*` tokens.
- Apply surfaces to major cards, table containers, navigation, forms, and
  dialogs. Keep table cells and small controls simple. Use existing table
  wrappers to contain horizontal scrolling on narrow screens.
- Primary actions use apple green with legible contrast; use neutral glass for
  secondary actions and retain clear danger, disabled, error, and success
  states.
- Preserve visible keyboard focus, readable contrast, touch-friendly sizing,
  reduced-motion preferences, and a solid/opaque fallback when backdrop blur is
  unsupported.
- Keep the login composition and authentication flow intact. Do not add
  frontend labels such as “Mock data”, “Demo data”, “Sample records”,
  “Fictional data”, or “Placeholder data”.

## New pages and components

Before building a page, inspect the existing shared components, layouts, and
design tokens. Start with the appropriate existing application shell, compose
the page from reusable surfaces and controls, and extend the shared design
system if a genuinely new component pattern is needed. New pages should follow
the same emPLE glass style from their first implementation, work at mobile and
desktop widths, and preserve application accessibility and authorization
behavior.
