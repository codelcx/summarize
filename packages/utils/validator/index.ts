export const validateEmail = (email: string) =>
{
  const re = /\S[^\s@]*@\S+\.\S+/
  return re.test(email)
}
