/**
 * Google Identity Services helper.
 *
 * Why a shared helper:
 *   - `google.accounts.id.initialize()` must only be called ONCE per page load.
 *     Calling it on every button click produces the GSI_LOGGER warning
 *     "initialize() is called multiple times" and breaks subsequent prompts.
 *   - FedCM (the new Chrome federated sign-in) can be silently disabled by the
 *     browser after the user dismisses the prompt. When that happens we fall
 *     back to the classic popup-based OAuth flow so the button keeps working.
 */

type CredentialResponse = { credential: string }

type GoogleIdApi = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        use_fedcm_for_prompt?: boolean
      }) => void
      prompt: (
        listener?: (notification: {
          isNotDisplayed: () => boolean
          isSkippedMoment: () => boolean
          isDismissedMoment: () => boolean
          getNotDisplayedReason: () => string
          getSkippedReason: () => string
        }) => void,
      ) => void
    }
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: { access_token?: string; error?: string }) => void
      }) => { requestAccessToken: () => void }
    }
  }
}

let initialized = false
let currentCallback: ((idToken: string) => void) | null = null

function getGoogle(): GoogleIdApi | null {
  return (window as unknown as { google?: GoogleIdApi }).google ?? null
}

function ensureInit(clientId: string) {
  const google = getGoogle()
  if (!google) throw new Error("Google sign-in is still loading. Try again.")
  if (initialized) return google

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (currentCallback && response?.credential) {
        currentCallback(response.credential)
      }
    },
  })
  initialized = true
  return google
}

/**
 * Trigger Google sign-in. Resolves with the Google ID token (JWT).
 * Falls back from the FedCM One-Tap prompt to a classic OAuth popup
 * when the prompt is unavailable or has been dismissed/blocked.
 */
export function signInWithGoogle(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const settleIdToken = (token: string) => {
      if (settled) return
      settled = true
      resolve(token)
    }
    const settleError = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }

    let google: GoogleIdApi
    try {
      google = ensureInit(clientId)
    } catch (e) {
      settleError(e as Error)
      return
    }

    // The ID-token callback set on initialize() is shared, so we route
    // *this* call's resolver through the module-level currentCallback.
    currentCallback = settleIdToken

    const fallbackToPopup = () => {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: (res) => {
            if (res.access_token) {
              // The backend expects an ID token; access tokens won't verify.
              // Fetch userinfo + return access_token so backend can choose, or
              // surface a clearer error. Most backends prefer ID token, so we
              // error out gracefully here.
              settleError(
                new Error(
                  "Google sign-in via popup returned no ID token. Please enable third-party sign-in in your browser settings and try again.",
                ),
              )
            } else {
              settleError(new Error(res.error ?? "Google sign-in was cancelled"))
            }
          },
        })
        tokenClient.requestAccessToken()
      } catch (e) {
        settleError(e as Error)
      }
    }

    try {
      google.accounts.id.prompt((notification) => {
        if (
          notification.isNotDisplayed() ||
          notification.isSkippedMoment() ||
          notification.isDismissedMoment()
        ) {
          // FedCM blocked / dismissed — drop back to the classic popup.
          fallbackToPopup()
        }
      })
    } catch {
      fallbackToPopup()
    }
  })
}
