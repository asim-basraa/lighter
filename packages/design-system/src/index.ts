/**
 * @lighter/design-system — a comprehensive, DTCG-token-driven React component library that also
 * ships a json-render registry (so specs render as this DS) and, at build, the `catalog.json` +
 * `tokens.json` artifacts Lighter ingests. Swap the DTCG tokens and everything re-themes.
 *
 * Import the stylesheet once: `import '@lighter/design-system/styles.css'`, and wrap your app in
 * `<ThemeProvider>` (from `@lighter/design-system/theme`).
 */

// Theme + tokens
export { ThemeProvider, useTheme, type ThemeMode, type ResolvedTheme } from './theme/index.js';
export {
  tokens,
  flatTokens,
  themeStylesheet,
  resolveTokens,
  toFlatTokens,
  toCssDeclarations,
  themeCss,
  cssVarName,
  type ResolvedTokens,
  type ResolvedToken,
  type DtcgDoc,
} from './tokens/index.js';

// Utilities
export { cx, type ClassValue } from './util/cx.js';

// Layout
export {
  Box,
  Stack,
  HStack,
  VStack,
  Grid,
  Container,
  Center,
  Spacer,
  Divider,
  AspectRatio,
  PageShell,
  type SpaceScale,
} from './components/layout.js';

// Typography
export {
  Heading,
  Text,
  Paragraph,
  Label,
  Link,
  Code,
  Kbd,
  Blockquote,
  List,
  ListItem,
} from './components/typography.js';

// Buttons
export {
  Button,
  IconButton,
  ButtonGroup,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './components/button.js';

// Forms
export {
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Field,
  Fieldset,
} from './components/form.js';

// Data display
export {
  Card,
  Badge,
  Tag,
  Avatar,
  AvatarGroup,
  Progress,
  Spinner,
  Skeleton,
  EmptyState,
  Stat,
  type Tone,
} from './components/data-display.js';

// Feedback
export { Alert, Callout, Banner, type Status } from './components/feedback.js';

// Overlays
export {
  Dialog,
  AlertDialog,
  Drawer,
  Popover,
  DropdownMenu,
  Tooltip,
  type DialogProps,
  type AlertDialogProps,
  type DrawerProps,
  type PopoverProps,
  type DropdownMenuProps,
  type DropdownMenuEntry,
  type TooltipProps,
} from './components/overlay.js';

// Navigation
export {
  Tabs,
  Accordion,
  Breadcrumb,
  Pagination,
  Steps,
  NavLink,
  type TabItem,
  type AccordionItem,
  type BreadcrumbItem,
  type StepItem,
} from './components/navigation.js';

// Tables + more data display
export {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  DataTable,
  DescriptionList,
  Timeline,
  Rating,
  type DataTableColumn,
  type DescriptionListItem,
  type TimelineItem,
} from './components/table.js';

// Icons
export {
  Icon,
  iconNames,
  CheckIcon,
  CloseIcon,
  ChevronDownIcon,
  SearchIcon,
  MenuIcon,
  type IconName,
  type IconProps,
} from './components/icon.js';

// json-render integration
export {
  SpecView,
  registry,
  catalog,
  catalogDefs,
  components,
  type PreviewSpec,
  type CatalogComponent,
} from './registry/index.js';
