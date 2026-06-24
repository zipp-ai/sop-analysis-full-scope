# RegulationDropdown Component

A reusable React component for selecting multiple compliance requirements/regulations with search functionality.

## Features

- **Multi-select**: Select multiple regulations with checkboxes
- **Search functionality**: Filter regulations by name
- **Loading states**: Shows spinner while loading data
- **Error handling**: Displays error messages when data loading fails
- **Responsive design**: Works on mobile and desktop
- **Keyboard accessible**: Supports keyboard navigation
- **Tag display**: Shows selected regulations as removable tags
- **Click outside to close**: Automatically closes dropdown when clicking outside

## Usage

```jsx
import RegulationDropdown from '../common/RegulationDropdown';

function MyComponent() {
  const [selectedRegulations, setSelectedRegulations] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRegulationToggle = (regulation) => {
    setSelectedRegulations(prev => {
      const isAlreadySelected = prev.some(r => r.id === regulation.id);
      
      if (isAlreadySelected) {
        // Remove the regulation if already selected
        return prev.filter(r => r.id !== regulation.id);
      } else {
        // Add the regulation if not already selected
        return [...prev, regulation];
      }
    });
  };

  return (
    <RegulationDropdown
      regulations={regulations}
      selectedRegulations={selectedRegulations}
      onRegulationToggle={handleRegulationToggle}
      loading={loading}
      error={null}
      placeholder="Select compliance requirements"
      searchPlaceholder="Search compliance..."
      className="my-custom-class"
      disabled={false}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `regulations` | Array | `[]` | Array of regulation objects with `id` and `name` properties |
| `selectedRegulations` | Array | `[]` | Array of currently selected regulations |
| `onRegulationToggle` | Function | - | Callback when a regulation is selected/deselected |
| `loading` | Boolean | `false` | Whether the component is in loading state |
| `error` | String | `null` | Error message to display |
| `placeholder` | String | `"Select compliance requirements"` | Placeholder text when no regulations selected |
| `searchPlaceholder` | String | `"Search compliance..."` | Placeholder text for search input |
| `className` | String | `""` | Additional CSS class for styling |
| `disabled` | Boolean | `false` | Whether the dropdown is disabled |

## Regulation Object Structure

Each regulation object should have the following structure:

```javascript
{
  id: "unique-id",
  name: "Regulation Name"
}
```

## Styling

The component comes with default styling but can be customized by:

1. **CSS classes**: Add custom classes via the `className` prop
2. **CSS variables**: Override the following CSS variables in your stylesheet:
   - `--bg-slate-50`: Background color for the dropdown trigger
3. **CSS overrides**: Target the component's CSS classes directly

## Example Integration

This component was extracted from `AssessmentForm` and can be used in any component that needs regulation selection functionality:

- Gap Analysis forms
- SOP creation/editing
- Compliance management interfaces
- Audit forms

## Accessibility

- Uses semantic HTML with proper ARIA attributes
- Supports keyboard navigation
- Click outside to close functionality
- Focus management for search input
- Screen reader friendly

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- IE11+ (with polyfills)