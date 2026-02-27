import DOMPurify from 'dompurify'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { logError } from '../services/errorLogService.js'

const DEFAULT_MIN_HEIGHT = 400
const SANITIZE_EVENT_MESSAGE = 'HTML sanitize: conteudo removido'
const SANITIZE_EVENT_ACTION = 'sanitize_html'

let sanitizeHookReady = false
let activeSanitizeCollector = null

function ensureSanitizeHooks() {
  if (sanitizeHookReady || typeof DOMPurify.addHook !== 'function') {
    return
  }

  DOMPurify.addHook('uponSanitizeElement', (_node, data) => {
    if (!activeSanitizeCollector || !data?.tagName) {
      return
    }
    const tagName = String(data.tagName).toLowerCase()
    if (tagName === 'script') {
      activeSanitizeCollector.add('script')
    }
    if (tagName === 'iframe') {
      activeSanitizeCollector.add('iframe')
    }
  })

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (!activeSanitizeCollector || !data?.attrName) {
      return
    }
    const attrName = String(data.attrName).toLowerCase()
    if (attrName.startsWith('on') && data.keepAttr === false) {
      activeSanitizeCollector.add('event_handler')
      return
    }
    if (
      (attrName === 'href' || attrName === 'src' || attrName === 'xlink:href') &&
      typeof data.attrValue === 'string' &&
      /^\s*javascript:/i.test(data.attrValue)
    ) {
      activeSanitizeCollector.add('javascript_url')
    }
  })

  sanitizeHookReady = true
}

function logSanitizeEvent(eventTypes, securityContext) {
  if (!securityContext?.page || !eventTypes.length) {
    return
  }

  logError({
    page: securityContext.page,
    message: SANITIZE_EVENT_MESSAGE,
    severity: 'warn',
    userId: securityContext.userId || undefined,
    context: {
      action: SANITIZE_EVENT_ACTION,
      eventTypes: eventTypes.join(','),
      tenantHint: securityContext.tenantHint || null,
      source: securityContext.source || 'front',
    },
  })
}

function getDocumentFromIframe(iframe) {
  try {
    return iframe?.contentDocument || iframe?.contentWindow?.document || null
  } catch (_) {
    return null
  }
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
  {
    srcDoc,
    minHeight = DEFAULT_MIN_HEIGHT,
    onLoad,
    trusted = false,
    securityContext = null,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = useRef(null)
  const lastSanitizeEventsRef = useRef(null)
  const allowSameOrigin = Boolean(trusted)
  const sanitizedSrcDoc = useMemo(() => {
    if (typeof srcDoc !== 'string' || !srcDoc.trim()) {
      return ''
    }
    const canCollect = Boolean(securityContext?.page)
    const eventTypes = canCollect ? new Set() : null
    ensureSanitizeHooks()
    if (eventTypes && sanitizeHookReady) {
      activeSanitizeCollector = eventTypes
    }
    let sanitized
    try {
      sanitized = DOMPurify.sanitize(srcDoc, {
        WHOLE_DOCUMENT: true,
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
        ADD_TAGS: ['style'],
        ADD_ATTR: ['style', 'class', 'id'],
      })
    } finally {
      activeSanitizeCollector = null
    }
    if (eventTypes && eventTypes.size) {
      lastSanitizeEventsRef.current = { types: Array.from(eventTypes) }
    } else {
      lastSanitizeEventsRef.current = null
    }
    return typeof sanitized === 'string' ? sanitized : String(sanitized || '')
  }, [securityContext, srcDoc])

  useEffect(() => {
    const last = lastSanitizeEventsRef.current
    if (last?.types?.length) {
      logSanitizeEvent(last.types, securityContext)
    }
  }, [sanitizedSrcDoc, securityContext])

  useImperativeHandle(forwardedRef, () => innerRef.current)

  useEffect(() => {
    const iframe = innerRef.current
    if (!iframe) {
      return undefined
    }

    let resizeObserver
    const sandboxed = !allowSameOrigin

    const handleLoad = (event) => {
      if (sandboxed) {
        iframe.style.height = `${minHeight}px`
        iframe.style.overflow = 'auto'
        if (typeof onLoad === 'function') {
          onLoad(event)
        }
        return
      }

      iframe.style.height = 'auto'
      iframe.style.overflow = 'hidden'
      scheduleHeightAdjustments()
      setupResizeObserver()

      if (typeof onLoad === 'function') {
        onLoad(event)
      }
    }

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

    iframe.addEventListener('load', handleLoad)

    return () => {
      iframe.removeEventListener('load', handleLoad)
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = undefined
      }
    }
  }, [sanitizedSrcDoc, minHeight, onLoad, allowSameOrigin])

  return (
    <iframe
      {...rest}
      ref={innerRef}
      sandbox={allowSameOrigin ? 'allow-same-origin' : ''}
      srcDoc={sanitizedSrcDoc}
      scrolling={allowSameOrigin ? 'no' : 'auto'}
    />
  )
})
