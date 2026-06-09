import { useState, useMemo } from 'react'
import { ocvService } from './services/ocv'
import OcvView from './OcvView'

export default function OcvPage() {
  const [activeAntigen, setActiveAntigen] = useState('MCV1')
  const [selectedCountry, setSelectedCountry] = useState('NGA')
  const [activeTab, setActiveTab] = useState('overview')

  // Memoize data processing
  const data = useMemo(() => ocvService.getProcessedData(), [])

  return (
    <OcvView
      activeAntigen={activeAntigen}
      setActiveAntigen={setActiveAntigen}
      selectedCountry={selectedCountry}
      setSelectedCountry={setSelectedCountry}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      data={data}
    />
  )
}
