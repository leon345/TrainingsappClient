import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  apiClient as standardApiClient,
  extrahiereFehlermeldung,
  istBenutzerV1,
  type ApiClient,
  type BenutzerV1,
} from '../api/client';

export type AuthStatus = 'ladend' | 'angemeldet' | 'abgemeldet' | 'fehler';

export interface AbmeldeErgebnis {
  readonly erfolg: boolean;
  readonly fehler?: string;
}

export interface AuthKontextWert {
  readonly benutzer: BenutzerV1 | null;
  readonly status: AuthStatus;
  readonly fehlerMeldung: string | null;
  readonly frischRegistriert: boolean;
  readonly apiClient: ApiClient;
  readonly aktualisiereSitzung: () => Promise<BenutzerV1 | null>;
  readonly setzeAngemeldetenBenutzer: (benutzer: BenutzerV1, frischRegistriert?: boolean) => void;
  readonly abmelden: () => Promise<AbmeldeErgebnis>;
}

const STANDARD_AUTH_KONTEXT: AuthKontextWert = {
  benutzer: null,
  status: 'abgemeldet',
  fehlerMeldung: null,
  frischRegistriert: false,
  apiClient: standardApiClient,
  aktualisiereSitzung: async () => null,
  setzeAngemeldetenBenutzer: () => {},
  abmelden: async () => ({ erfolg: true }),
};

const AuthContext = createContext<AuthKontextWert>(STANDARD_AUTH_KONTEXT);

export interface AuthProviderProps {
  readonly children: ReactNode;
  readonly client?: ApiClient;
  readonly initialBenutzer?: BenutzerV1 | null;
  readonly initialStatus?: AuthStatus;
  readonly automatischLaden?: boolean;
}

export function AuthProvider({
  children,
  client = standardApiClient,
  initialBenutzer = null,
  initialStatus,
  automatischLaden = true,
}: AuthProviderProps) {
  const sollLaden = automatischLaden && initialStatus === undefined && initialBenutzer === null;

  const [benutzer, setBenutzer] = useState<BenutzerV1 | null>(initialBenutzer);
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (initialStatus !== undefined) {
      return initialStatus;
    }
    if (initialBenutzer !== null) {
      return 'angemeldet';
    }
    return sollLaden ? 'ladend' : 'abgemeldet';
  });
  const [fehlerMeldung, setFehlerMeldung] = useState<string | null>(null);
  const [frischRegistriert, setFrischRegistriert] = useState<boolean>(false);

  const anfrageZaehlerRef = useRef<number>(0);

  const aktualisiereSitzung = useCallback(async (): Promise<BenutzerV1 | null> => {
    const anfrageId = ++anfrageZaehlerRef.current;

    try {
      const { data, error, response } = await client.GET('/v1/ich');
      if (anfrageId !== anfrageZaehlerRef.current) {
        return null;
      }

      if (response.status === 401) {
        setBenutzer(null);
        setStatus('abgemeldet');
        setFehlerMeldung(null);
        setFrischRegistriert(false);
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && contentType.includes('application/json') && istBenutzerV1(data)) {
        setBenutzer(data);
        setStatus('angemeldet');
        setFehlerMeldung(null);
        return data;
      }

      setBenutzer(null);
      setStatus('fehler');
      setFehlerMeldung(
        extrahiereFehlermeldung(
          error,
          'Der Sitzungsstatus konnte nicht geprüft werden. Der Server ist möglicherweise nicht erreichbar.',
          response,
        ),
      );
      return null;
    } catch (ex) {
      if (anfrageId !== anfrageZaehlerRef.current) {
        return null;
      }
      setBenutzer(null);
      setStatus('fehler');
      setFehlerMeldung(
        extrahiereFehlermeldung(
          ex,
          'Der Server ist derzeit nicht erreichbar. Der Timer bleibt lokal nutzbar.',
        ),
      );
      return null;
    }
  }, [client]);

  useEffect(() => {
    if (!sollLaden) {
      return;
    }
    let aktiv = true;
    const lade = async () => {
      if (!aktiv) {
        return;
      }
      await aktualisiereSitzung();
    };
    void lade();
    return () => {
      aktiv = false;
    };
  }, [sollLaden, aktualisiereSitzung]);

  const setzeAngemeldetenBenutzer = useCallback(
    (neuerBenutzer: BenutzerV1, neuRegistriert = false) => {
      anfrageZaehlerRef.current += 1;
      setBenutzer(neuerBenutzer);
      setStatus('angemeldet');
      setFehlerMeldung(null);
      setFrischRegistriert(neuRegistriert);
    },
    [],
  );

  const abmelden = useCallback(async (): Promise<AbmeldeErgebnis> => {
    anfrageZaehlerRef.current += 1;
    try {
      const { error, response } = await client.POST('/v1/abmelden');
      if (response.status === 204 || response.status === 200 || response.status === 401) {
        setBenutzer(null);
        setStatus('abgemeldet');
        setFehlerMeldung(null);
        setFrischRegistriert(false);
        return { erfolg: true };
      }
      return {
        erfolg: false,
        fehler: extrahiereFehlermeldung(error, 'Abmeldung fehlgeschlagen.', response),
      };
    } catch (ex) {
      return {
        erfolg: false,
        fehler: extrahiereFehlermeldung(ex, 'Abmeldung wegen Netzwerkfehler fehlgeschlagen.'),
      };
    }
  }, [client]);

  const wert = useMemo<AuthKontextWert>(
    () => ({
      benutzer,
      status,
      fehlerMeldung,
      frischRegistriert,
      apiClient: client,
      aktualisiereSitzung,
      setzeAngemeldetenBenutzer,
      abmelden,
    }),
    [
      benutzer,
      status,
      fehlerMeldung,
      frischRegistriert,
      client,
      aktualisiereSitzung,
      setzeAngemeldetenBenutzer,
      abmelden,
    ],
  );

  return <AuthContext.Provider value={wert}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthKontextWert {
  return useContext(AuthContext);
}
