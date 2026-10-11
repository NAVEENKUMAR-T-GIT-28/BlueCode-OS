# Shared components

Reusable visual elements belong here when they are shared across multiple features. Preserve current class names in `index.css` during extraction to reduce visual regression risk.

Suggested groups:
- `ui/`: Button, Badge, Field, TextArea
- `feedback/`: LoadingState, ErrorState, EmptyState, Notice, InlineFeedback
- `data-display/`: DataTable, StatusBadge, ScoreBadge
- `branding/`: Logo, AppMark

Avoid moving a component merely to satisfy a folder structure. Keep this migration incremental and behavior-preserving.
