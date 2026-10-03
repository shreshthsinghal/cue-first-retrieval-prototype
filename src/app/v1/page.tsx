import { PrototypeApp } from '@/components/app/prototype-app'

// v1, kept reachable for comparison. The retrieval core is the v1 engine
// (string-to-string matching over authored labels) and its API lives under
// /api/v1/*.
export default function Page() {
  return <PrototypeApp />
}
