// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  // Navigation icons
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  
  // Tab bar icons for User
  'square.grid.2x2.fill': 'dashboard',
  'person.fill': 'person',
  'book.fill': 'library-books',
  
  // Tab bar icons for Admin
  'chart.bar.fill': 'bar-chart',
  'shield.fill': 'admin-panel-settings',
  
  // Additional common icons
  'gearshape.fill': 'settings',
  'person.3': 'group',
  'bell.fill': 'notifications',
  'magnifyingglass': 'search',
  'plus': 'add',
  'xmark': 'close',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'heart.fill': 'favorite',
  'star.fill': 'star',
  'star': 'star-outline',
  'message.fill': 'message',
  'photo.fill': 'photo',
  'camera.fill': 'camera-alt',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'checkmark': 'check',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle.fill': 'info',
  'questionmark.circle.fill': 'help',
  'lock.fill': 'lock',
  'envelope.fill': 'email',
  'phone.fill': 'phone',
  'calendar': 'calendar-today',
  'clock.fill': 'schedule',
  'location.fill': 'location-on',
  'doc.fill': 'description',
  'folder.fill': 'folder',
  'link': 'link',
  'share': 'share',
  'bookmark.fill': 'bookmark',
  'flag.fill': 'flag',
  'eye.fill': 'visibility',
  'eye.slash.fill': 'visibility-off',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name as string] || 'help-outline';
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
