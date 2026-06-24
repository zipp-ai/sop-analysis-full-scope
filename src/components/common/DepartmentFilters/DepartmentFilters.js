import React, { useState, useEffect, useRef } from 'react';
import './DepartmentFilters.css';
import departmentService from '../../../services/departmentService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';


const DepartmentFilters = ({ 
  onDepartmentChange,
  defaultSelected = 'All',
  refreshTrigger = 0
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState(defaultSelected);
  const [departments, setDepartments] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toShow, setToShow] = useState(false);  
  const dropdownRef = useRef(null);

  // Fetch departments from API when component mounts
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        // Get departments from the service
        const response = await departmentService.getAllDepartments();
        
        // Combine "All" with the departments from the API
        const allDepartments = ['All', ...response.departments];
        
        setDepartments(allDepartments);
        if(response.departments.length > 0){
          setToShow(true);
        }
        
        // Check if currently selected department is still available
        if (selectedDepartment !== 'All' && !allDepartments.includes(selectedDepartment)) {
          setSelectedDepartment('All');
          if (onDepartmentChange) {
            onDepartmentChange('All');
          }
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        
        let errorMessage = 'Failed to fetch departments.';
        if (error?.response?.data?.detail) {
          errorMessage = error?.response?.data?.detail;
        }
        
        // Fallback to default departments if API fails
        const fallbackDepartments = ["All"];
        setDepartments(fallbackDepartments);
        
        // Check if currently selected department is still available in fallback
        if (selectedDepartment !== 'All' && !fallbackDepartments.includes(selectedDepartment)) {
          setSelectedDepartment('All');
          if (onDepartmentChange) {
            onDepartmentChange('All');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [refreshTrigger]);

  const handleDepartmentClick = (dept) => {
    setSelectedDepartment(dept);
    if (onDepartmentChange) {
      onDepartmentChange(dept);
    }
  };

  return (
    <>{toShow?( <div className="department-filters-container">
      <h2 className="filter-heading">Category Filters</h2>
      
      {loading ? (
        <div className="departments-loading">
          <LoadingSpinner size="small" />
        </div>
      ) : (
        <div 
          className="department-drawer-container" 
          ref={dropdownRef}
          onMouseEnter={() => setIsDropdownOpen(true)}
          onMouseLeave={() => setIsDropdownOpen(false)}
        >
          <button className="selected-department filter-btn active">
            {selectedDepartment}
          </button>
          
          <div className={`department-drawer ${isDropdownOpen ? 'open' : ''}`}>
            {departments
              .filter(dept => dept !== selectedDepartment)
              .map((dept, index) => (
                <button
                  key={index}
                  className="filter-btn drawer-item"
                  onClick={() => handleDepartmentClick(dept)}
                >
                  {dept}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>):('')}</>
   
  );
};

export default DepartmentFilters;