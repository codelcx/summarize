declare module 'module'
{
  declare global
  {
    interface Window
    {
      __APP_INFO__: {
        version: string
        buildTime: string
      }
    }
  }
}
