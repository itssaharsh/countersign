// react-three-fiber v9: register three.js classes as JSX intrinsic elements for TypeScript.
import type { ThreeElements } from '@react-three/fiber'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
