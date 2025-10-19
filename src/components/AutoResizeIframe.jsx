import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const DEFAULT_MIN_HEIGHT = 400

function getDocumentFromIframe(iframe) {
  return iframe?.contentDocument || iframe?.contentWindow?.document || null
}

function computeDocumentHeight(doc) {
  if (!doc) {
    return 0
  }
  const { body, documentElement } = doc
  const metrics = [
    body?.scrollHeight,
    body?.offsetHeight,
    documentElement?.scrollHeight,
    documentElement?.offsetHeight,
    documentElement?.clientHeight,
  ].filter((value) => typeof value === 'number')

  return metrics.length ? Math.max(...metrics) : 0
}

export const AutoResizeIframe = forwardRef(function AutoResizeIframe(
  { srcDoc, minHeight = DEFAULT_MIN_HEIGHT, onLoad, ...rest },
  forwardedRef,
) {
  const innerRef = useRef(null)

  useImperativeHandle(forwardedRef, () => innerRef.current)

  useEffect(() => {
    const iframe = innerRef.current
    if (!iframe) {
      return undefined
    }

    let resizeObserver

    const applyHeight = () => {
      const doc = getDocumentFromIframe(iframe)
      const contentHeight = computeDocumentHeight(doc)
      const targetHeight = Math.max(contentHeight, minHeight)
      iframe.style.height = `${targetHeight}px`
    }

    const setupResizeObserver = () => {
      const doc = getDocumentFromIframe(iframe)
      if (!doc || typeof ResizeObserver !== 'function') {
        return
      }

      resizeObserver = new ResizeObserver(() => {
        applyHeight()
      })

      const targets = [doc.documentElement, doc.body].filter(Boolean)
      targets.forEach((target) => {
        try {
          resizeObserver.observe(target)
        } catch (error) {
          // Ignore observer attachment errors (e.g., detached node)
        }
      })
    }

    const scheduleHeightAdjustments = () => {
      applyHeight()
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => applyHeight())
      }
      setTimeout(() => applyHeight(), 50)
    }

    const handleLoad = (event) => {
      iframe.style.height = 'auto'
      iframe.style.overflow = 'hidden'
      scheduleHeightAdjustments()
      setupResizeObserver()

      if (typeof onLoad === 'function') {
        onLoad(event)
      }
    }

    iframe.addEventListener('load', handleLoad)

    return () => {
      iframe.removeEventListener('load', handleLoad)
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = undefined
      }
    }
  }, [srcDoc, minHeight, onLoad])

  return (
    <iframe
      {...rest}
      ref={innerRef}
      srcDoc={srcDoc}
      scrolling="no"
    />
  )
})
