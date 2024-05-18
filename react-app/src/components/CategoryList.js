import React, { useState, useEffect } from 'react';

const CategoryList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uniqueCategories, setUniqueCategories] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3031/api/products')
      .then(response => response.json())
      .then(data => {
        setProducts(data.products);
        setLoading(false);

        // Obtener categorías únicas
        const categoriesSet = new Set(data.products.map(product => product.Category));
        setUniqueCategories(Array.from(categoriesSet));
      })
      .catch(error => console.error('Error fetching products:', error));
  }, []);

  return (
    <div className="container">
      <h2 className="text-center">Lista de Categorías</h2>
      {loading ? (
        <p className="text-center">Cargando productos...</p>
      ) : (
        <div className="row justify-content-center align-items-center">
          {uniqueCategories.map((category, index) => (
            <div key={index} className="col-lg-6 mb-4">
              <div className="card shadow mb-4">
                <div className="card-header py-3">
                  <h5 className="m-0 font-weight-bold text-gray-800 text-center">{category}</h5>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryList;
