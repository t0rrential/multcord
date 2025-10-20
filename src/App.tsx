import './App.css'
import Iridescence from './components/react-bits/Iridescence'
import Toolbar from './components/ui/Toolbar'

function App() {

  return (
    <main className='w-full h-screen bg-white text-white relative'>
      <Iridescence
        color={[1, 1, 1]}
        mouseReact={false}
        amplitude={0.1}
        speed={1.0}
        className="absolute inset-0 w-full h-full"
      />

      <div className='absolute top-5 left-10 z-10'>
        <Toolbar />
      </div>
    </main>
  )
}

export default App
