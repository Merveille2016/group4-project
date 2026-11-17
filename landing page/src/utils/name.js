// "Jane Mary Doe" becomes "Jane"; extra spaces around or between names are ignored
export function firstName(name) {
  return name ? name.trim().split(/\s+/)[0] : ''
}
