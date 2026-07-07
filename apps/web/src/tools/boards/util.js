export function statusColumn(board) {
  return board.columns.find(c => c.type === 'status');
}

export function initials(name) {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_PALETTE = ['#0073ea', '#a25ddc', '#00c875', '#e2445c', '#fdab3d', '#579bfc', '#ff642e'];

export function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
