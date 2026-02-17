import frappe

def boot_session(bootinfo):
    """
    Called during session boot.
    Add custom data to bootinfo if needed.
    """
    bootinfo.ai_accountant_enabled = True
