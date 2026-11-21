// Akadálymentesítési kellékek az RN-komponensekhez (RN 0.88 és react-native-web 0.21 is érti a role/aria-* propokat).
// Címkével: egyetlen „kép” elem a felolvasónak. Címke nélkül: díszítés, a felolvasó átugorja (a gyerekeit is).

export interface A11yKepProps {
  accessible: boolean;
  role?: 'img';
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

export function a11yKep(label?: string): A11yKepProps {
  return label ? { accessible: true, role: 'img', 'aria-label': label } : { accessible: false, 'aria-hidden': true };
}
