#!/bin/bash

# Script to make a user an admin in Voidspace

USERNAME="${1:-sh0tybumbati}"

echo "Making user '$USERNAME' an admin..."

psql postgresql://postgres@localhost:5432/voidspace <<EOF
UPDATE "User" SET "isAdmin" = true WHERE username = '$USERNAME';
SELECT username, "isAdmin" FROM "User" WHERE username = '$USERNAME';
EOF

echo ""
echo "Done! If the user exists, they are now an admin."
echo "They will need to log out and log back in for the changes to take effect."
