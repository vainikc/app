import { FaUserSecret } from 'react-icons/fa';

/**
 * Sherlock silhouette logo — uses the FontAwesome user-secret icon
 * which is a classic detective silhouette with hat + collar.
 * Rendered on transparent background with amber theme color.
 */
const SherlockLogo = ({ size = 44, className = '', color = '#d4a656' }) => {
  return (
    <FaUserSecret
      size={size}
      color={color}
      className={className}
      style={{ filter: 'drop-shadow(0 0 8px rgba(212, 166, 86, 0.25))' }}
    />
  );
};

export default SherlockLogo;
