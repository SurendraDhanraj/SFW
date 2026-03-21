import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useNavigate } from 'react-router-dom'

export default function CreateResident() {
  const navigate = useNavigate()
  const createResident = useMutation(api.residents.createResident)
  const filtersOpts = useQuery(api.geographic.getFilters)
  const streetSummary = useQuery(api.stats.getStreetSummary)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    systemId: '', consecNo: '', name: '', building: '', apt: '',
    address: '', pollingDivision: '', parliamentaryDistrict: '',
    municipalDistrict: '', registrationArea: '', corporation: '', securityCode: '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const id = await createResident({
        ...form,
        systemId: form.systemId || undefined,
        consecNo: form.consecNo || undefined,
        building: form.building || undefined,
        apt: form.apt || undefined,
        pollingDivision: form.pollingDivision || undefined,
        parliamentaryDistrict: form.parliamentaryDistrict || undefined,
        municipalDistrict: form.municipalDistrict || undefined,
        registrationArea: form.registrationArea || undefined,
        corporation: form.corporation || undefined,
        securityCode: form.securityCode || undefined,
      })
      navigate(`/residents/${id}`)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, required = false, placeholder = '', datalistId?: string) => (
    <div className="field-group">
      <label className="field-label" htmlFor={`field-${key}`}>{label}{required && ' *'}</label>
      <input id={`field-${key}`} type="text" className="field-input" required={required}
        placeholder={placeholder} value={form[key]} onChange={set(key)} list={datalistId} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <button className="header-back-btn" onClick={() => navigate(-1)} id="back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <div className="page-header-title">New Resident</div>
          <div className="page-header-subtitle">Create a resident record</div>
        </div>
      </div>

      <form className="form-page" onSubmit={handleSubmit} id="create-resident-form">
        <div className="form-section-label">Identification</div>
        {field('System ID', 'systemId', false, 'e.g. 8849-551')}
        {field('Consec No', 'consecNo', false, 'e.g. 00142')}
        {field('Full Name *', 'name', true, 'e.g. JOHN DOE-SMITH')}
        {field('Security Code', 'securityCode', false)}

        <div className="form-section-label">Address</div>
        {field('Building', 'building', false, 'e.g. Oak Building')}
        {field('Apt / Unit', 'apt', false, 'e.g. 4B')}
        {field('Address *', 'address', true, 'e.g. 142 Cedar Avenue', 'dl-street')}

        {streetSummary && (
          <datalist id="dl-street">
            {Array.from(new Set(streetSummary.map(s => s.street))).sort().map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}

        <div className="form-section-label">Geographic Classification</div>
        {field('Parliamentary Electoral District', 'parliamentaryDistrict', false, 'e.g. Central Parliamentary District', 'dl-parl')}
        {field('Municipal Electoral District', 'municipalDistrict', false, '', 'dl-mun')}
        {field('Corporation', 'corporation', false, "e.g. St. George's Corporation", 'dl-corp')}
        {field('Registration Area', 'registrationArea', false, '', 'dl-reg')}
        {field('Polling Division', 'pollingDivision', false, '', 'dl-poll')}

        {filtersOpts && (
          <>
            <datalist id="dl-parl">
              {filtersOpts.parliamentaryDistricts.map(d => <option key={d} value={d} />)}
            </datalist>
            <datalist id="dl-mun">
              {filtersOpts.municipalDistricts.map(d => <option key={d} value={d} />)}
            </datalist>
            <datalist id="dl-corp">
              {filtersOpts.corporations.map(d => <option key={d} value={d} />)}
            </datalist>
            <datalist id="dl-reg">
              {filtersOpts.registrationAreas.map(d => <option key={d} value={d} />)}
            </datalist>
            <datalist id="dl-poll">
              {filtersOpts.pollingDivisions.map(d => <option key={d} value={d} />)}
            </datalist>
          </>
        )}

        <button id="save-resident-btn" type="submit" className="btn btn-primary btn-full" disabled={saving} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          {saving ? 'Saving…' : <><span className="material-symbols-outlined icon-sm">person_add</span> Create Resident</>}
        </button>
      </form>
    </>
  )
}
