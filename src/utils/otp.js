export const generateOTP = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  return { code, expiry };
};
