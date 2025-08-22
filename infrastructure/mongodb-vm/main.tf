data "azurerm_subscription" "current" {}

# Random suffix for unique naming
resource "random_integer" "suffix" {
  min = 1000
  max = 9999
}

# Random password for VM admin access
resource "random_password" "vm_admin_password" {
  length  = 16
  special = true
}

# Timestamp for additional uniqueness
resource "time_static" "deployment_time" {}

locals {
  timestamp_suffix = substr(replace(time_static.deployment_time.unix, ".", ""), -4, -1)
  vm_name          = "${var.application_name}-vm-${random_integer.suffix.result}"
  unique_suffix    = "${random_integer.suffix.result}${local.timestamp_suffix}"
}

# Resource Group
resource "azurerm_resource_group" "mongodb_rg" {
  name     = "${var.application_name}-rg"
  location = var.location

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Community Edition VM"
  }
}

# Network Security Group
resource "azurerm_network_security_group" "mongodb_nsg" {
  name                = "${var.application_name}-nsg"
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name

  # SSH access rule (optional - only if needed for debugging)
  security_rule {
    name                       = "SSH"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # MongoDB access rule
  security_rule {
    name                       = "MongoDB"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = tostring(var.mongodb_port)
    source_address_prefixes    = var.allowed_mongodb_ips
    destination_address_prefix = "*"
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Virtual Network
resource "azurerm_virtual_network" "mongodb_vnet" {
  name                = "${var.application_name}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Subnet
resource "azurerm_subnet" "mongodb_subnet" {
  name                 = "${var.application_name}-subnet"
  resource_group_name  = azurerm_resource_group.mongodb_rg.name
  virtual_network_name = azurerm_virtual_network.mongodb_vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Public IP
resource "azurerm_public_ip" "mongodb_public_ip" {
  name                = "${var.application_name}-public-ip"
  resource_group_name = azurerm_resource_group.mongodb_rg.name
  location            = azurerm_resource_group.mongodb_rg.location
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "${var.application_name}-${local.unique_suffix}"

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Network Interface
resource "azurerm_network_interface" "mongodb_nic" {
  name                = "${var.application_name}-nic"
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.mongodb_subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.mongodb_public_ip.id
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Associate Network Security Group to Network Interface
resource "azurerm_network_interface_security_group_association" "mongodb_nsg_association" {
  network_interface_id      = azurerm_network_interface.mongodb_nic.id
  network_security_group_id = azurerm_network_security_group.mongodb_nsg.id
}

# Cloud-init script for MongoDB installation
locals {
  cloud_init_script = base64encode(templatefile("${path.module}/scripts/install-mongodb.sh", {
    MONGODB_VERSION = var.mongodb_version
    MONGODB_PORT    = var.mongodb_port
  }))
}

# Virtual Machine
resource "azurerm_linux_virtual_machine" "mongodb_vm" {
  name                = local.vm_name
  resource_group_name = azurerm_resource_group.mongodb_rg.name
  location            = azurerm_resource_group.mongodb_rg.location
  size                = var.vm_size
  admin_username      = var.admin_username
  # Generate a random password for VM access (SSH not needed)
  admin_password                  = random_password.vm_admin_password.result
  disable_password_authentication = false

  network_interface_ids = [
    azurerm_network_interface.mongodb_nic.id,
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_SSD_LRS"
    disk_size_gb         = var.disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = local.cloud_init_script

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Community Edition"
  }

  depends_on = [
    azurerm_network_interface_security_group_association.mongodb_nsg_association
  ]
}