import { useEffect, useState } from 'react'

// Returns the id of the section currently under the navbar.
// A section becomes active once its top passes a third of the way down the screen.
export default function useActiveSection(ids, enabled = true) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    if (!enabled) return

    function update() {
      const line = window.innerHeight / 3
      let current = ids[0]

      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }

      // The last section is often too short to reach the line, so force it at the bottom
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) current = ids[ids.length - 1]

      setActive(current)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ids, enabled])

  return active
}
