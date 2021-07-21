export const getServerHost = () => {
  const { PORT, HOST } = process.env
  return `http://${HOST}:${PORT}`
}
