import { Dashboard } from "@/components/Dashboard";
import { Analytics } from "@vercel/analytics/next"


export default function Page() {
  return(
    <>
    <Dashboard />
    <Analytics />
    </>
  )
}
