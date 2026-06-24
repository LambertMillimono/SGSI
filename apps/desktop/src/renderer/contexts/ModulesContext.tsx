import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ipc } from '../utils/ipcBridge'

export const ALL_MODULES = [
  { key: 'dashboard',  label: 'Tableau de bord',        description: 'Vue générale et statistiques en temps réel', required: true  },
  { key: 'students',   label: 'Gestion des élèves',    description: 'Dossiers, inscriptions, profils',            required: true  },
  { key: 'grades',     label: 'Notes & Bulletins',     description: 'Saisie des notes, génération des bulletins', required: true  },
  { key: 'payments',   label: 'Paiements',             description: 'Frais scolaires, reçus, impayés',            required: true  },
  { key: 'absences',   label: 'Absences & Présences',  description: 'Feuilles d\'appel, statistiques',            required: false },
  { key: 'schedule',   label: 'Emploi du temps',       description: 'Planning des cours, salles',                 required: false },
  { key: 'staff',      label: 'Personnel',             description: 'Enseignants, salaires',                      required: false },
  { key: 'payroll',   label: 'Paie du personnel',     description: 'Salaires, primes, bulletins de paie',        required: false },
  { key: 'expenses',   label: 'Dépenses',              description: 'Charges, caisse, dépenses internes',         required: false },
  { key: 'reports',    label: 'Rapports',              description: 'Statistiques, classements, exports',         required: false },
  { key: 'library',    label: 'Bibliothèque',          description: 'Gestion des livres et des prêts',            required: false },
  { key: 'infirmerie', label: 'Infirmerie',            description: 'Dossiers médicaux, consultations',           required: false },
  { key: 'transport',  label: 'Transport scolaire',    description: 'Bus, itinéraires, affectation',              required: false },
  { key: 'messages',   label: 'Messagerie interne',    description: 'Communication entre le personnel',           required: false },
]

const DEFAULT_ENABLED = ALL_MODULES.map(m => m.key)

interface ModulesCtx {
  enabledModules: string[]
  isEnabled: (key: string) => boolean
  reload: () => void
}

const ModulesContext = createContext<ModulesCtx>({
  enabledModules: DEFAULT_ENABLED,
  isEnabled: () => true,
  reload: () => {},
})

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [enabledModules, setEnabledModules] = useState<string[]>(DEFAULT_ENABLED)

  const reload = useCallback(() => {
    ipc.settings.getModules()
      .then(list => {
        // Required modules are always included regardless of DB value
        const required = ALL_MODULES.filter(m => m.required).map(m => m.key)
        const merged = Array.from(new Set([...required, ...list]))
        setEnabledModules(merged)
      })
      .catch(() => {}) // fallback: keep defaults
  }, [])

  useEffect(() => { reload() }, [reload])

  const isEnabled = useCallback((key: string) => {
    // Check exact key OR parent module (e.g. 'payments/plans' → also checks 'payments')
    const baseKey = key.split('/')[0]
    const mod = ALL_MODULES.find(m => m.key === key || m.key === baseKey)
    if (mod?.required) return true
    return enabledModules.includes(key) || enabledModules.includes(baseKey)
  }, [enabledModules])

  return (
    <ModulesContext.Provider value={{ enabledModules, isEnabled, reload }}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules() {
  return useContext(ModulesContext)
}
