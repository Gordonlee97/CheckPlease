export const PERSON_COLORS = [
  '#7b8fd4', // periwinkle
  '#c2546d', // rose
  '#3a9e8a', // teal
  '#8b6bc4', // violet
  '#5a9e6a', // sage
  '#4a8ec4', // sky
  '#b85a45', // rust
  '#9e5a8e', // plum
]

export function getPersonColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length]
}
