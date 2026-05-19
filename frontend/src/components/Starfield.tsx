import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  baseX: number
  baseY: number
  vx: number
  vy: number
  r: number
  phase: number
  speed: number
  parallax: number
  driftX: number
  driftY: number
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    let id: number

    const mouse = { x: null as number | null, y: null as number | null }

    const makeStars = (w: number, h: number): Star[] =>
      Array.from({ length: 220 }, () => {
        const x = Math.random() * w
        const y = Math.random() * h
        const r = Math.random() * 1.1 + 0.15
        return {
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          r,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.012 + 0.003,
          parallax: r * 0.18, // larger stars have more parallax
          driftX: (Math.random() - 0.5) * 0.1,
          driftY: (Math.random() - 0.5) * 0.1,
        }
      })

    let stars = makeStars(window.innerWidth, window.innerHeight)

    const resize = () => {
      c.width = window.innerWidth
      c.height = window.innerHeight
      stars = makeStars(c.width, c.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const handleMouseLeave = () => {
      mouse.x = null
      mouse.y = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      t += 0.01

      const w = c.width
      const h = c.height
      const scrollY = window.scrollY

      stars.forEach(s => {
        // 1. Natural drift of the base coordinate
        s.baseX += s.driftX
        s.baseY += s.driftY

        // Wrap the base coordinates
        if (s.baseX < 0) s.baseX += w
        if (s.baseX > w) s.baseX -= w
        if (s.baseY < 0) s.baseY += h
        if (s.baseY > h) s.baseY -= h

        // 2. Spring force toward base coordinate
        const ax = (s.baseX - s.x) * 0.02
        const ay = (s.baseY - s.y) * 0.02
        s.vx += ax
        s.vy += ay

        // 3. Mouse repulsion force
        if (mouse.x !== null && mouse.y !== null) {
          const dx = s.x - mouse.x
          const dy = s.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radius = 130
          if (dist < radius) {
            const force = (radius - dist) / radius
            const push = force * 3
            // Add repulsion force direction
            s.vx += (dx / (dist || 1)) * push
            s.vy += (dy / (dist || 1)) * push
          }
        }

        // 4. Update velocity and position
        s.vx *= 0.88
        s.vy *= 0.88
        s.x += s.vx
        s.y += s.vy

        // 5. Parallax rendering with wrapping
        const renderedX = s.x
        let renderedY = (s.y - scrollY * s.parallax) % h
        if (renderedY < 0) renderedY += h

        // 6. Draw star with twinkling alpha
        const a = 0.1 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed * 60 + s.phase))
        ctx.beginPath()
        ctx.arc(renderedX, renderedY, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(184, 212, 240, ${a})`
        ctx.fill()
      })

      id = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
