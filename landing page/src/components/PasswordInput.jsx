import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './Icons'

// Drop-in replacement for <input type="password"> with a show/hide button
function PasswordInput(props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export default PasswordInput
