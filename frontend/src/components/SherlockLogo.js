import { FaUserSecret } from 'react-icons/fa';

/**
 * Sherlock silhouette — modern monochrome white detective icon.
 * No background, no glow. Clean and geometric.
 */
const SherlockLogo = ({ size = 32, className = '', color = '#ffffff' }) => {
  return (
    <FaUserSecret
      size={size}
      color={color}
      className={className}
    />
  );
};

export default SherlockLogo;
