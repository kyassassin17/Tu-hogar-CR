export const photoBucket = 'listing-photos'
export const maxPhotos = 8
export const maxPhotoBytes = 5 * 1024 * 1024

export function selectedPhotos(data: FormData): File[] {
  return data.getAll('photos').filter((value): value is File => value instanceof File && !!value.name)
}

export async function validateListingPhotos(files: File[]) {
  if (files.length > maxPhotos) throw new Error('Puedes agregar hasta 8 fotos.')
  for (const file of files) {
    if (!['image/jpeg', 'image/png'].includes(file.type) || !/\.(jpe?g|png)$/i.test(file.name)) {
      throw new Error('Solo se permiten fotos JPEG o PNG.')
    }
    if (!file.size || file.size > maxPhotoBytes) throw new Error('Cada foto debe pesar entre 1 byte y 5 MB.')
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const valid = file.type === 'image/png'
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
      : header[0] === 255 && header[1] === 216 && header[2] === 255
    if (!valid) throw new Error('El contenido de la foto no corresponde a un archivo JPEG o PNG.')
  }
}