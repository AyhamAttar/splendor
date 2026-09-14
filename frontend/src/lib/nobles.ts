/**
 * Noble artwork. Each noble id (1-12) maps to a fixed image file so a given
 * noble always shows the same item; each game reveals a random subset (see the
 * engine's setup). Files live in `public/assets/Nobels Itemes/`.
 */
const NOBLE_IMAGE_FILES = [
  "Ceremonial Horn.jpg", // id 1
  "Jeweled Goblet.jpg", // id 2
  "Jeweled Necklace.jpg", // id 3
  "Noble Dagger.jpg", // id 4
  "Noble Signet Ring.jpg", // id 5
  "Ornate Hand Mirror.jpg", // id 6
  "Ornate Noble Tankard.jpg", // id 7
  "Ornate Royal Key.jpg", // id 8
  "Ornate Royal Sword.jpg", // id 9
  "Royal Crown.jpg", // id 10
  "Royal Quill.jpg", // id 11
  "Royal Wax Seal.jpg", // id 12
];

/** Public URL of a noble's artwork, or null if the id has no mapped image. */
export function nobleImage(id: number): string | null {
  const file = NOBLE_IMAGE_FILES[id - 1];
  return file ? encodeURI(`/assets/Nobels Itemes/${file}`) : null;
}

/** Display name of the treasure a noble brings (from its artwork file). */
export function nobleItemName(id: number): string | null {
  const file = NOBLE_IMAGE_FILES[id - 1];
  return file ? file.replace(/\.[^.]+$/, "") : null;
}
