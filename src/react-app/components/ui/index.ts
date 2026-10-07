// 共用元件（設計系統）。各元件依職責放在這個資料夾，從這裡統一 import：'../ui'、'../components/ui'。
// ui/ 裡的檔案彼此之間用具名路徑（./Button），不要經過這個 index，否則會形成循環 import。
export { Avatar, type AvatarSize } from './Avatar';
export { Badge, type BadgeTone } from './Badge';
export { Button, ButtonLink, MoreLink, TextLink, type ButtonSize, type ButtonVariant } from './Button';
export { MiniIconButton, ShowAllToggle, StretchedButton, TableToggle, ToggleButton } from './button-variants';
export { cn } from './cn';
export { Dialog } from './Dialog';
export { Field, Input, SearchInput, Select, Textarea, type FieldAria, type FieldLayout } from './fields';
export { type IconProp } from './icon';
export { gridKeyTarget } from './keyboard';
export { Card, CardHeader, PageHeader, PageStack, SectionLabel, type SectionLabelTone } from './layout';
export { usePrefersReducedMotion } from './motion';
export { Countdown, Duration, Figure, NumDisplay, Unit, type NumSize } from './numbers';
export { GoalProgress, ProgressBar, ProgressRing, type ProgressTone } from './progress';
export { Segmented } from './Segmented';
export { EmptyState, ErrorNote, PageLoader, Spinner } from './states';
export { Highlight, Kbd } from './text';
export { Checkbox, Switch } from './toggles';
export { useConfirm, type ConfirmOptions, type ConfirmTone } from './useConfirm';
