import React, { useState, useEffect } from "react";

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3031/api/products")
      .then((response) => response.json())
      .then((data) => {
        setProducts(data.products);
        setLoading(false);
      })
      .catch((error) => console.error("Error fetching products:", error));
  }, []);

  return (
    <div>
      <h2>Lista de Productos</h2>
      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <div className="row">
          {products.map((product) => (
            <div key={product.IDProduct} className="col-lg-6">
              <div className="card shadow mb-4 ">
                <div className="card-header py-3">
                  <h5 className="m-0 font-weight-bold text-gray-800">
                    {product.NameProduct}
                  </h5>
                </div>
                <div className="card-body">
                  <p className="h5 mb-0 font-weight-bold text-gray-800">
                    ID: {product.IDProduct}
                  </p>
                  <p className="h5 mb-0 font-weight-bold text-gray-800">
                    Precio: ${product.Price}
                  </p>
                  {/* Accede al nombre de la categoría correctamente */}
                  <p className="h5 mb-0 font-weight-bold text-gray-800">
                    Categoría: {product.Category || "Sin categoría"}
                  </p>
                  <p className="h5 mb-0 font-weight-bold text-gray-800">
                    Descripción: {product.DescriptionProduct}
                  </p>
                  {/* Muestra la imagen (asegúrate de tener la URL correcta) */}

                  <img
                    src={`http://localhost:3031/img/products/${product.Image}`}
                    alt={product.NameProduct}
                    className="img-fluid rounded col-md-4"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductList;
