import { getCountryOptions } from '../countries'

export default function CountrySelect({ value, onChange, onBlur, language = 'es', invalid = false }) {
  const options = getCountryOptions(language)
  const selectedIsListed = options.some(option => option.code === value)
  const english = language === 'en'
  const label = english ? 'Country ISO' : 'País ISO'
  const placeholder = english ? 'Select your country' : 'Selecciona tu país'

  return <label className="field" htmlFor="parcel-country">
    {label}
    <select id="parcel-country" name="country" className="select" value={value || ''} onChange={event => onChange(event.target.value)} onBlur={onBlur} required aria-invalid={invalid} aria-describedby={invalid ? 'parcel-country-error' : undefined}>
      <option value="" disabled>{placeholder}</option>
      {!selectedIsListed && value && <option value={value}>{value} ({value})</option>}
      {options.map(option => <option value={option.code} key={option.code}>{option.name} ({option.code})</option>)}
    </select>
    {invalid && <small id="parcel-country-error" role="alert">{english ? 'Select a country.' : 'Selecciona tu país.'}</small>}
  </label>
}
