export const PAPER = { A4: [210, 297], A3: [297, 420] };

/** Split rows into pages of n. */
export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
};
