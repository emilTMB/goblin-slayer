# scripts/local/precommit-dialog.ps1
Add-Type -AssemblyName PresentationFramework

$Xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="Проверка перед коммитом"
        SizeToContent="WidthAndHeight"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        Topmost="True"
        Background="White">
  <StackPanel Margin="20">
    <TextBlock FontFamily="Segoe UI Emoji"
               FontSize="16"
               TextWrapping="Wrap">
      <Run Text="1. 🧱 Проверь, что нужные блоки существуют и корректно подключены?" />
      <LineBreak/>
      <Run Text="2.   Пробегись по БЕМ - все ли в порядке?🐈" />
      <LineBreak/>
      <Run Text="🐀Если нет уверенности в каком-то из пунктов - бегом править!🐀" />
    </TextBlock>

    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,12,0,0">
      <Button Name="YesBtn" MinWidth="90" Margin="0,0,8,0">Да</Button>
      <Button Name="NoBtn" MinWidth="90">Нет</Button>
    </StackPanel>
  </StackPanel>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader ([xml]$Xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

$yes = $window.FindName("YesBtn")
$no  = $window.FindName("NoBtn")

$script:result = $false
$yes.Add_Click({ $script:result = $true;  $window.Close() })
$no.Add_Click({ $script:result = $false; $window.Close() })

$window.ShowDialog() | Out-Null
if ($script:result) { exit 0 } else { exit 1 }
