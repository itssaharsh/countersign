import { Backdrop } from './components/fx/Backdrop'
import { CountersignLayout } from './CountersignLayout'

export default function App() {
  return (
    <>
      <Backdrop />
      <div className="relative z-10 h-full">
        <CountersignLayout />
      </div>
    </>
  )
}
