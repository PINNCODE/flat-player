import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';

/**
 * Adaptador para almacenamiento en Tizen
 * Usa Tizen's Filesystem o Web Storage como fallback
 */
@Injectable({
  providedIn: 'root'
})
export class TizenStorageAdapter {
  private isTizen: boolean;
  private storageKey = 'flatplayer_auth';

  constructor() {
    this.isTizen = this.detectTizen();
  }

  /**
   * Detecta si corre en entorno Tizen
   */
  private detectTizen(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).tizen !== 'undefined';
  }

  /**
   * Guarda datos en el almacenamiento
   */
  setItem(key: string, value: string): Observable<void> {
    try {
      if (this.isTizen) {
        // Usar Tizen Filesystem si está disponible
        return this.setTizenItem(key, value);
      } else {
        // Fallback a localStorage
        localStorage.setItem(key, value);
        return of(void 0);
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
      // Fallback a localStorage si falla Tizen
      localStorage.setItem(key, value);
      return of(void 0);
    }
  }

  /**
   * Obtiene datos del almacenamiento
   */
  getItem(key: string): Observable<string | null> {
    try {
      if (this.isTizen) {
        return this.getTizenItem(key);
      } else {
        return of(localStorage.getItem(key));
      }
    } catch (error) {
      console.error('Error reading from storage:', error);
      return of(localStorage.getItem(key));
    }
  }

  /**
   * Elimina datos del almacenamiento
   */
  removeItem(key: string): Observable<void> {
    try {
      if (this.isTizen) {
        return this.removeTizenItem(key);
      } else {
        localStorage.removeItem(key);
        return of(void 0);
      }
    } catch (error) {
      console.error('Error removing from storage:', error);
      localStorage.removeItem(key);
      return of(void 0);
    }
  }

  /**
   * Limpia todo el almacenamiento
   */
  clear(): Observable<void> {
    try {
      if (this.isTizen) {
        return this.clearTizenStorage();
      } else {
        localStorage.clear();
        return of(void 0);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      localStorage.clear();
      return of(void 0);
    }
  }

  /**
   * Guarda usando Tizen Filesystem
   */
  private setTizenItem(key: string, value: string): Observable<void> {
    return from(new Promise<void>((resolve, reject) => {
      try {
        const tizen = (window as any).tizen;
        const filesystem = tizen.filesystem;
        
        // Usar filesystem virtual directory
        const virtualRoot = 'documents';
        
        filesystem.resolve(
          virtualRoot,
          (dir: any) => {
            const fileName = `${this.storageKey}_${key}`;
            const file = dir.createFile(fileName);
            
            file.openStream(
              'w',
              (stream: any) => {
                stream.write(value);
                stream.close();
                resolve();
              },
              (error: any) => {
                console.error('Error opening stream:', error);
                // Fallback a localStorage
                localStorage.setItem(key, value);
                resolve();
              },
              'UTF-8'
            );
          },
          (error: any) => {
            console.error('Error resolving directory:', error);
            // Fallback a localStorage
            localStorage.setItem(key, value);
            resolve();
          }
        );
      } catch (error) {
        // Fallback a localStorage si falla Tizen
        localStorage.setItem(key, value);
        resolve();
      }
    }));
  }

  /**
   * Obtiene usando Tizen Filesystem
   */
  private getTizenItem(key: string): Observable<string | null> {
    return from(new Promise<string | null>((resolve) => {
      try {
        const tizen = (window as any).tizen;
        const filesystem = tizen.filesystem;
        
        const virtualRoot = 'documents';
        
        filesystem.resolve(
          virtualRoot,
          (dir: any) => {
            const fileName = `${this.storageKey}_${key}`;
            
            dir.listFiles(
              (files: any) => {
                const file = files.find((f: any) => f.name === fileName);
                
                if (!file) {
                  resolve(null);
                  return;
                }
                
                file.openStream(
                  'r',
                  (stream: any) => {
                    stream.read((data: any) => {
                      stream.close();
                      resolve(data);
                    });
                  },
                  (error: any) => {
                    console.error('Error opening stream:', error);
                    resolve(localStorage.getItem(key));
                  },
                  'UTF-8'
                );
              },
              (error: any) => {
                console.error('Error listing files:', error);
                resolve(localStorage.getItem(key));
              }
            );
          },
          (error: any) => {
            console.error('Error resolving directory:', error);
            resolve(localStorage.getItem(key));
          }
        );
      } catch (error) {
        resolve(localStorage.getItem(key));
      }
    }));
  }

  /**
   * Elimina usando Tizen Filesystem
   */
  private removeTizenItem(key: string): Observable<void> {
    return from(new Promise<void>((resolve) => {
      try {
        const tizen = (window as any).tizen;
        const filesystem = tizen.filesystem;
        
        const virtualRoot = 'documents';
        
        filesystem.resolve(
          virtualRoot,
          (dir: any) => {
            const fileName = `${this.storageKey}_${key}`;
            
            dir.listFiles(
              (files: any) => {
                const file = files.find((f: any) => f.name === fileName);
                
                if (file) {
                  dir.deleteFile(
                    fileName,
                    () => resolve(),
                    (error: any) => {
                      console.error('Error deleting file:', error);
                      localStorage.removeItem(key);
                      resolve();
                    }
                  );
                } else {
                  localStorage.removeItem(key);
                  resolve();
                }
              },
              (error: any) => {
                console.error('Error listing files:', error);
                localStorage.removeItem(key);
                resolve();
              }
            );
          },
          (error: any) => {
            console.error('Error resolving directory:', error);
            localStorage.removeItem(key);
            resolve();
          }
        );
      } catch (error) {
        localStorage.removeItem(key);
        resolve();
      }
    }));
  }

  /**
   * Limpia usando Tizen Filesystem
   */
  private clearTizenStorage(): Observable<void> {
    return from(new Promise<void>((resolve) => {
      try {
        const tizen = (window as any).tizen;
        const filesystem = tizen.filesystem;
        
        const virtualRoot = 'documents';
        
        filesystem.resolve(
          virtualRoot,
          (dir: any) => {
            dir.listFiles(
              (files: any) => {
                const authFiles = files.filter((f: any) => f.name.startsWith(this.storageKey));
                
                let deletedCount = 0;
                const totalToDelete = authFiles.length;
                
                if (totalToDelete === 0) {
                  resolve();
                  return;
                }
                
                authFiles.forEach((file: any) => {
                  dir.deleteFile(
                    file.name,
                    () => {
                      deletedCount++;
                      if (deletedCount === totalToDelete) {
                        resolve();
                      }
                    },
                    (error: any) => {
                      console.error('Error deleting file:', error);
                      deletedCount++;
                      if (deletedCount === totalToDelete) {
                        resolve();
                      }
                    }
                  );
                });
              },
              (error: any) => {
                console.error('Error listing files:', error);
                localStorage.clear();
                resolve();
              }
            );
          },
          (error: any) => {
            console.error('Error resolving directory:', error);
            localStorage.clear();
            resolve();
          }
        );
      } catch (error) {
        localStorage.clear();
        resolve();
      }
    }));
  }
}
