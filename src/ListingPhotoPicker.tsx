import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { validateListingPhotos } from './lib/listingPhotos'

function PhotoPreview({ file }: { file: File }) {
  const reference = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (reference.current) reference.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <img ref={reference} alt={`Vista previa: ${file.name}`} />
}

export default function ListingPhotoPicker({ files, disabled, onChange }: {
  files: File[]
  disabled: boolean
  onChange: (files: File[]) => void
}) {
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  return <fieldset className="photo-picker" disabled={disabled || validating}>
    <legend className="field-label">Fotos de la propiedad</legend>
    <label>
      <span><ImagePlus size={18} /> Agregar fotos JPEG o PNG</span>
      <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple aria-describedby="photo-limits" onChange={async (event) => {
        const next = [...files, ...Array.from(event.currentTarget.files ?? [])]
        event.currentTarget.value = ''
        setValidating(true)
        setError('')
        try {
          await validateListingPhotos(next)
          onChange(next)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'No se pudieron agregar las fotos.')
        } finally {
          setValidating(false)
        }
      }} />
    </label>
    <p id="photo-limits" className="field-note">Hasta 8 fotos, máximo 5 MB por foto.</p>
    {validating && <p role="status">Validando fotos...</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!!files.length && <ul className="photo-previews">
      {files.map((file, index) => <li key={`${file.name}-${index}`}>
        <PhotoPreview file={file} />
        <div><span title={file.name}>{index === 0 ? `Portada: ${file.name}` : file.name}</span>
          <button type="button" className="icon-button" title={`Quitar ${file.name}`} aria-label={`Quitar ${file.name}`} onClick={() => {
            onChange(files.filter((_, position) => position !== index))
            setError('')
          }}><Trash2 size={17} /></button>
        </div>
      </li>)}
    </ul>}
  </fieldset>
}